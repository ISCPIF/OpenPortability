import { createClient } from '@supabase/supabase-js';
import TelegramBot from 'node-telegram-bot-api';
import * as winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

export interface PlatformStats {
  total: number;
  hasFollowed: number;
  notFollowed: number;
}

interface UserCompleteStats {
  connections: {
    followers: number;
    following: number;
  };
  matches: {
    bluesky: PlatformStats;
    mastodon: PlatformStats;
  };
  updated_at: string;
}


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

      // Récupérer les stats globales
      const globalStats = await this.getGlobalStats();

      // Construire le message de rapport
      let message = `📊 Rapport de surveillance\n\n`;
      message += `👥 Utilisateurs inscrits: ${userCount}\n`;
      message += `📥 Tâches d'import totales: ${jobCount}\n`;
      message += `❌ Tâches en erreur: ${failedCount}\n\n`;
      
      message += `🌐 Statistiques globales:\n`;
      message += `➡️ Total followers: ${globalStats.total_followers}\n`;
      message += `➡️ Total following: ${globalStats.total_following}\n\n`;
      message += `🟦 Bluesky:\n`;
      message += `   • Total: ${globalStats.total_bluesky}\n`;
      message += `   • Suivis: ${globalStats.bluesky_followed}\n`;
      message += `🐘 Mastodon:\n`;
      message += `   • Total: ${globalStats.total_mastodon}\n`;
      message += `   • Suivis: ${globalStats.mastodon_followed}`;

      await this.sendAlert(message);
      logger.info('Rapport envoyé');
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      logger.error('Error checking updates:', errorMessage);
      await this.sendAlert(`🔴 Erreur lors de la génération du rapport: ${errorMessage}`);
    }
  }

  private async getGlobalStats() {
    const { data, error } = await this.supabasePublic
      .from('user_stats_cache')
      .select('stats');

    if (error) {
      logger.error('Erreur lors de la récupération des stats globales:', error);
      throw error;
    }

    interface GlobalStats {
      total_followers: number;
      total_following: number;
      total_bluesky: number;
      bluesky_followed: number;
      total_mastodon: number;
      mastodon_followed: number;
    }

    // Calculer les totaux à partir des stats de chaque utilisateur
    const totals = data.reduce((acc: GlobalStats, row: { stats: UserCompleteStats }) => {
      const stats = row.stats;
      return {
        total_followers: (acc.total_followers || 0) + (stats.connections?.followers || 0),
        total_following: (acc.total_following || 0) + (stats.connections?.following || 0),
        total_bluesky: (acc.total_bluesky || 0) + (stats.matches?.bluesky?.total || 0),
        bluesky_followed: (acc.bluesky_followed || 0) + (stats.matches?.bluesky?.hasFollowed || 0),
        total_mastodon: (acc.total_mastodon || 0) + (stats.matches?.mastodon?.total || 0),
        mastodon_followed: (acc.mastodon_followed || 0) + (stats.matches?.mastodon?.hasFollowed || 0)
      };
    }, {
      total_followers: 0,
      total_following: 0,
      total_bluesky: 0,
      bluesky_followed: 0,
      total_mastodon: 0,
      mastodon_followed: 0
    });

    return totals;
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