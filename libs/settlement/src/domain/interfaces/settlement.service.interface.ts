import { Trade } from '@prisma/client'

import {
  AckSettlementDto,
  AckSettlementResponseDto,
  GetSettlementSignatureDto,
  SettlementSignatureResponseDto,
  SignalPaymentDto,
  SignalPaymentResponseDto,
} from '../schemas'

export interface ISettlementService {
  /**
   * Generate a settlement signature for a trade
   * @param dto Settlement signature request parameters
   * @param trade The trade entity from database
   * @returns Settlement signature response with signature and deadline
   */
  getSettlementSignature(dto: GetSettlementSignatureDto, trade: Trade): Promise<SettlementSignatureResponseDto>

  /**
   * Acknowledge settlement selection status
   * @param dto Acknowledgement parameters including chosen status
   * @returns Acknowledgement response
   */
  ackSettlement(dto: AckSettlementDto): Promise<AckSettlementResponseDto>

  /**
   * Signal payment initiation and queue transfer
   * @param dto Signal payment parameters
   * @param trade The trade entity from database
   * @returns Signal payment response
   */
  signalPayment(dto: SignalPaymentDto, trade: Trade): Promise<SignalPaymentResponseDto>
}
