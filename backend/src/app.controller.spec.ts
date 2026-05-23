import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return app metadata', () => {
      expect(appController.getOverview()).toEqual(
        expect.objectContaining({
          name: 'bingo-backend',
        }),
      );
    });

    it('should return health information', () => {
      expect(appController.getHealth()).toEqual(
        expect.objectContaining({
          status: 'ok',
        }),
      );
    });
  });
});
