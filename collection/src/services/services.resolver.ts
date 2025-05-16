import { Query, Resolver } from '@nestjs/graphql';
import { SERVICES_LIST } from '../common/constants/services.constants/services.constants';
import { Service } from './service.entity/service.entity';

@Resolver(() => Service)
export class ServicesResolver {
  @Query(() => [Service])
  getServices(): Service[] {
    return SERVICES_LIST;
  }
}
