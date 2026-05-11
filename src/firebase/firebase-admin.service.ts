import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App;

  onModuleInit() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase Admin environment variables are missing');
    }

    if (!getApps().length) {
      this.app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      this.logger.log('Firebase Admin initialized successfully');
      return;
    }

    this.app = getApps()[0];
  }

  getMessaging(): Messaging {
    return getMessaging(this.app);
  }
}
