import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  try {
    const app = await NestFactory.create(AppModule);

    app.use(helmet());

    app.enableCors({
      origin: true,
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    const port = process.env.PORT ? Number(process.env.PORT) : 9000;
    console.log(`Server is running on port ${port}`);
    await app.listen(port);
  } catch (error) {
    console.error('Failed to bootstrap application:', error);
    process.exit(1);
  }
}

void bootstrap();
