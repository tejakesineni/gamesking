import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getOverview() {
    return {
      name: 'bingo-backend',
      description: 'NestJS API for online bingo rooms and game orchestration.',
      features: ['room creation', 'room discovery', 'postgres persistence'],
    };
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
