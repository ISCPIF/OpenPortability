"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPythonTask = processPythonTask;
// python_worker/src/PythonProcessor.ts
const supabase_js_1 = require("@supabase/supabase-js");
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
// Promisify exec pour utiliser async/await
const execPromise = (0, util_1.promisify)(child_process_1.exec);
// Charger les variables d'environnement
dotenv.config();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
    });
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
/**
 * Met à jour le statut d'une tâche dans la base de données
 */
async function updateTaskStatus(taskId, status, result = null, errorLog = null) {
    try {
        const { error } = await supabase
            .from('python_tasks')
            .update({
            status,
            result,
            error_log: errorLog,
            updated_at: new Date().toISOString()
        })
            .match({ id: taskId });
        if (error) {
            console.error(`❌ Error updating task status:`, error);
            throw error;
        }
    }
    catch (error) {
        console.error(`❌ Error in updateTaskStatus for task ${taskId}:`, error);
        throw error;
    }
}
/**
 * Exécute le test DM via le script Python
 */
async function executeTestDm(task, workerId) {
    try {
        console.log(`🐍 [Python Worker ${workerId}] Executing test-dm for user ${task.user_id} with handle ${task.payload.handle}`);
        // Vérifier que le payload contient un handle Bluesky
        if (!task.payload.handle) {
            throw new Error('Missing Bluesky handle in task payload');
        }
        // Chemin vers le script Python
        const scriptPath = path_1.default.resolve(process.cwd(), './testDm.py');
        // Exécuter le script Python avec le handle comme argument en utilisant l'environnement virtuel
        const pythonExecutable = process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : 'python3';
        const { stdout, stderr } = await execPromise(`${pythonExecutable} ${scriptPath} ${task.payload.handle}`);
        console.log(`🐍 [Python Worker ${workerId}] test-dm script output:`, stdout);
        if (stderr && !stdout.includes('Successfully sent DM') && !stdout.includes('Message envoyé avec succès')) {
            console.error(`❌ [Python Worker ${workerId}] test-dm script error:`, stderr);
            // Déterminer si l'utilisateur doit suivre la plateforme
            if (stderr.includes('recipient requires incoming messages to come from someone they follow') ||
                stdout.includes('recipient requires incoming messages to come from someone they follow')) {
                return {
                    success: false,
                    error: 'DM failed: User needs to follow the platform',
                    needs_follow: true
                };
            }
            return {
                success: false,
                error: stderr
            };
        }
        // Vérifier si le DM a été envoyé avec succès
        if (stdout.includes('Successfully sent DM') || stdout.includes('Message envoyé avec succès')) {
            return {
                success: true
            };
        }
        // Retourner une erreur générique dans les autres cas
        return {
            success: false,
            error: 'Unknown error sending DM'
        };
    }
    catch (error) {
        console.error(`❌ [Python Worker ${workerId}] Error in executeTestDm:`, error);
        throw error;
    }
}
/**
 * Exécute l'envoi de newsletter de recommandations
 */
async function executeSendRecoNewsletter(task, workerId) {
    try {
        console.log(`🐍 [Python Worker ${workerId}] Executing send-reco-newsletter for user ${task.user_id}`);
        // Chemin vers le script Python
        const scriptPath = path_1.default.resolve(process.cwd(), './sendRecoNewsletter.py');
        // Préparer les arguments JSON pour le script
        const jsonArgs = JSON.stringify(task.payload);
        // Exécuter le script Python avec les arguments JSON en utilisant l'environnement virtuel
        const pythonExecutable = process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : 'python3';
        const { stdout, stderr } = await execPromise(`${pythonExecutable} ${scriptPath} '${jsonArgs}'`);
        console.log(`🐍 [Python Worker ${workerId}] send-reco-newsletter script output:`, stdout);
        if (stderr) {
            console.error(`❌ [Python Worker ${workerId}] send-reco-newsletter script error:`, stderr);
            return {
                success: false,
                error: stderr
            };
        }
        // Analyser la sortie JSON
        try {
            const result = JSON.parse(stdout);
            return {
                success: true,
                ...result
            };
        }
        catch (e) {
            return {
                success: true,
                raw_output: stdout
            };
        }
    }
    catch (error) {
        console.error(`❌ [Python Worker ${workerId}] Error in executeSendRecoNewsletter:`, error);
        throw error;
    }
}
/**
 * Traite une tâche Python en fonction de son type
 */
async function processPythonTask(task, workerId) {
    console.log(`🐍 [Python Worker ${workerId}] Processing task ${task.id} of type ${task.task_type}`);
    try {
        let result;
        // Exécuter la fonction appropriée selon le type de tâche
        switch (task.task_type) {
            case 'test-dm':
                result = await executeTestDm(task, workerId);
                break;
            case 'send-reco-newsletter':
                result = await executeSendRecoNewsletter(task, workerId);
                break;
            default:
                throw new Error(`Unsupported task type: ${task.task_type}`);
        }
        // Mettre à jour le statut de la tâche
        await updateTaskStatus(task.id, result.success ? 'completed' : 'failed', result, result.success ? null : result.error);
        console.log(`✅ [Python Worker ${workerId}] Task ${task.id} ${result.success ? 'completed' : 'failed'}`);
    }
    catch (error) {
        console.error(`❌ [Python Worker ${workerId}] Error processing task ${task.id}:`, error);
        // Mettre à jour le statut en cas d'erreur
        try {
            await updateTaskStatus(task.id, 'failed', null, error instanceof Error ? error.message : String(error));
        }
        catch (updateError) {
            console.error(`💥 [Python Worker ${workerId}] Failed to update task status:`, updateError);
        }
    }
}
