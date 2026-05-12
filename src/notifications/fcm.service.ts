import { Injectable } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

@Injectable()
export class FcmService {
  constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

  async sendToToken(params: {
    token: string;
    title: string;
    body: string;
    imageUrl?: string | null;
    data?: Record<string, string>;
  }): Promise<string> {
    const messaging = this.firebaseAdminService.getMessaging();

    return messaging.send({
      token: params.token,
      notification: {
        title: params.title,
        body: params.body,
        imageUrl: params.imageUrl ?? undefined,
      },
      data: params.data,
    });
  }
}
