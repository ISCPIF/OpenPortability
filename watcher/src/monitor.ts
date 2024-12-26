import { createClient } from '@supabase/supabase-js';
import TelegramBot from 'node-telegram-bot-api';
import * as winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'monitor.log' }),
    new winston.transports.Console()
  ]
});

class TelegramMonitor {
  private supabaseAuth: any;
  private supabasePublic: any;
  private bot: TelegramBot;
  private checkInterval: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    const options = {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    };

    // Client pour next-auth.users
    this.supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: "next-auth"
        }
      }
    );

    // Client pour public.import_jobs
    this.supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      options
    );

    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
  }

  async start() {
    try {
      // Premier rapport immédiat
      await this.checkUpdates();
      
      // Rapport périodique toutes les 30 minutes
      setInterval(() => this.checkUpdates(), this.checkInterval);

      logger.info('Monitoring started');
    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      await this.sendAlert(`🔴 Erreur au démarrage du monitoring: ${error}`);
    }
  }

  private async checkUpdates() {
    try {
      // Compter le nombre total d'utilisateurs
      const { count: userCount, error: userCountError } = await this.supabaseAuth
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (userCountError) {
        logger.error('Erreur lors du comptage des utilisateurs:', userCountError);
        throw userCountError;
      }

      // Compter le nombre total de tâches d'import
      const { count: jobCount, error: jobCountError } = await this.supabasePublic
        .from('import_jobs')
        .select('*', { count: 'exact', head: true });

      if (jobCountError) {
        logger.error('Erreur lors du comptage des tâches:', jobCountError);
        throw jobCountError;
      }

      // Compter les tâches en erreur
      const { count: failedCount, error: failedCountError } = await this.supabasePublic
        .from('import_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      if (failedCountError) {
        logger.error('Erreur lors du comptage des tâches en erreur:', failedCountError);
        throw failedCountError;
      }

      // Construire le message de rapport
      let message = `📊 Rapport de surveillance\n\n`;
      message += `👥 Utilisateurs inscrits: ${userCount}\n`;
      message += `📥 Tâches d'import totales: ${jobCount}\n`;
      message += `❌ Tâches en erreur: ${failedCount}`;

      await this.sendAlert(message);
      logger.info('Rapport envoyé');
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      logger.error('Error checking updates:', errorMessage);
      await this.sendAlert(`🔴 Erreur lors de la génération du rapport: ${errorMessage}`);
    }
  }

  private async sendAlert(message: string) {
    try {
      await this.bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, message);
      logger.info('Rapport envoyé');
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
    }
  }
}

// Démarrer le moniteur
const monitor = new TelegramMonitor();
monitor.start().catch(console.error);