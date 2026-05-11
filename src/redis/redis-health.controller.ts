import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @Public()
  @Get('redis')
  async checkRedis() {
    const key = 'health:redis';

    await this.redisService.set(
      key,
      {
        status: 'ok',
        checkedAt: new Date().toISOString(),
      },
      30,
    );

    const data = await this.redisService.get<{
      status: string;
      checkedAt: string;
    }>(key);

    return {
      success: true,
      message: 'Redis is working',
      data,
    };
  }
}
