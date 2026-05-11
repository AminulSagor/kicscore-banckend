import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { HealthController } from './redis-health.controller';

@Global()
@Module({
  providers: [RedisService],
  controllers: [HealthController],
  exports: [RedisService],
})
export class RedisModule {}
