import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global module exposing the {@link PrismaService} so any feature module can
 * inject it without re-importing.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
