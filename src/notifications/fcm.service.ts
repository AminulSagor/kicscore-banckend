import { Injectable } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

@Injectable()
export class FcmService {
  constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

  async sendToToken(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const messaging = this.firebaseAdminService.getMessaging();

    return messaging.send({
      token: params.token,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: params.data,
    });
  }
}
