import { ITypes } from '@optimex-xyz/market-maker-sdk'

import { AbiCoder } from 'ethers'

export interface LiquidateAffiliateInfo {
  positionId: string
  liquidationId: string
  apm: string
  isLending: boolean
  isLiquidate: boolean
  validatorSignature: string
}

const abiCoder = AbiCoder.defaultAbiCoder()

const toSolidityType = (type: any): string => {
  if (typeof type === 'string') return type
  if (Array.isArray(type)) {
    const struct = type[0]
    const members = Object.entries(struct)
      .map(([key, val]) => `${toSolidityType(val)} ${key}`)
      .join(',')
    return `tuple(${members})[]`
  }

  if (typeof type === 'object' && type !== null) {
    const members = Object.entries(type)
      .map(([key, val]) => `${toSolidityType(val)} ${key}`)
      .join(',')
    return `tuple(${members})`
  }

  throw new Error(`Unsupported type: ${type}`)
}

export const schemaToAbi = (schema: Record<string, any>) => {
  const abiArgs = Object.entries(schema)
    .map(([key, val]) => `${toSolidityType(val)} ${key}`)
    .join(',')

  const abi = [`tuple(${abiArgs})`]

  return abi
}

const mapArrayToObject = (data: any[], schema: Record<string, any>): any => {
  const result: any = {}
  const keys = Object.keys(schema)

  keys.forEach((key, index) => {
    if (data[index] !== undefined) {
      const schemaType = schema[key]

      // Handle nested objects
      if (typeof schemaType === 'object' && !Array.isArray(schemaType) && Array.isArray(data[index])) {
        result[key] = mapArrayToObject(data[index], schemaType)
      } else {
        result[key] = data[index]
      }
    }
  })

  return result
}

export const decodeAffiliateInfo = (affiliateInfo: ITypes.AffiliateStructOutput) => {
  try {
    const schemaObj = JSON.parse(affiliateInfo.schema).schema

    const abi = schemaToAbi(schemaObj)

    const output = abiCoder.decode(abi, affiliateInfo.data)

    // Map array to object based on schema
    const mappedOutput = mapArrayToObject(output[0], schemaObj)

    return mappedOutput as LiquidateAffiliateInfo
  } catch {
    return null
  }
}

export const isLiquidateAffiliate = (data: any): data is LiquidateAffiliateInfo =>
  'isLiquidate' in data && 'liquidationId' in data
