import { HttpModule, HttpService } from '@nestjs/axios';
import { DynamicModule, Module, Provider } from '@nestjs/common';

import { defaultReqConfig, ReqModuleConfig } from './req.config';
import { ReqService } from './req.service';

export interface ReqModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<ReqModuleConfig> | ReqModuleConfig;
  inject?: any[];
  imports?: any[];
  serviceKey?: string;
}

@Module({})
export class ReqModule {
  static register(
    config: ReqModuleConfig & { serviceKey?: string },
  ): DynamicModule {
    const serviceKey = config.serviceKey || 'DEFAULT_REQ_SERVICE';
    const finalConfig = {
      ...defaultReqConfig,
      ...config,
    };

    return {
      module: ReqModule,
      imports: [HttpModule.register({})],
      providers: [
        {
          provide: `${serviceKey}_CONFIG`,
          useValue: finalConfig,
        },
        {
          provide: serviceKey,
          useFactory: (config: ReqModuleConfig, httpService: HttpService) => {
            return new ReqService(config, httpService);
          },
          inject: [`${serviceKey}_CONFIG`, HttpService],
        },
      ],
      exports: [serviceKey],
    };
  }

  static registerAsync(options: ReqModuleAsyncOptions): DynamicModule {
    const serviceKey = options.serviceKey || 'DEFAULT_REQ_SERVICE';

    const configProvider: Provider = {
      provide: `${serviceKey}_CONFIG`,
      useFactory: async (...args) => ({
        ...defaultReqConfig,
        ...(await options.useFactory(...args)),
      }),
      inject: options.inject || [],
    };

    const serviceProvider: Provider = {
      provide: serviceKey,
      useFactory: (config: ReqModuleConfig, httpService: HttpService) => {
        return new ReqService(config, httpService);
      },
      inject: [`${serviceKey}_CONFIG`, HttpService],
    };

    return {
      module: ReqModule,
      imports: [
        HttpModule.registerAsync({
          imports: options.imports,
          useFactory: async (...args) => {
            const config = await options.useFactory(...args);
            return {
              timeout: config.timeout || defaultReqConfig.timeout,
              headers: {
                ...defaultReqConfig.defaultHeaders,
                ...config.defaultHeaders,
              },
            };
          },
          inject: options.inject,
        }),
        ...(options.imports || []),
      ],
      providers: [configProvider, serviceProvider],
      exports: [serviceKey],
    };
  }
}
