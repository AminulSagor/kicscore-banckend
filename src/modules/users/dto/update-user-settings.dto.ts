import { IsIn, IsOptional } from 'class-validator';
import { UnitSystem } from 'src/common/utils/unit-system.enum';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsIn([UnitSystem.METRIC, UnitSystem.IMPERIAL])
  unitSystem?: UnitSystem;
}
