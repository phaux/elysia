import { Value } from '@sinclair/typebox/value'
import type { TypeCheck } from '@sinclair/typebox/compiler'
import { TSchema } from '@sinclair/typebox'

// ? Cloudflare worker support
const env =
	typeof Bun !== 'undefined'
		? Bun.env
		: typeof process !== 'undefined'
		? process?.env
		: undefined

export const ERROR_CODE = Symbol('ErrorCode')

export const isProduction = (env?.NODE_ENV ?? env?.ENV) === 'production'

export type ElysiaErrors =
	| InternalServerError
	| NotFoundError
	| ParseError
	| ValidationError
	| InvalidCookieSignature

export class InternalServerError extends Error {
	code = 'INTERNAL_SERVER_ERROR'
	status = 500

	constructor(message?: string) {
		super(message ?? 'INTERNAL_SERVER_ERROR')
	}
}

export class NotFoundError extends Error {
	code = 'NOT_FOUND'
	status = 404

	constructor(message?: string) {
		super(message ?? 'NOT_FOUND')
	}
}

export class ParseError extends Error {
	code = 'PARSE'
	status = 400

	constructor(message?: string) {
		super(message ?? 'PARSE')
	}
}

export class InvalidCookieSignature extends Error {
	code = 'INVALID_COOKIE_SIGNATURE'
	status = 400

	constructor(public key: string, message?: string) {
		super(message ?? `"${key}" has invalid cookie signature`)
	}
}

export class ValidationError extends Error {
	code = 'VALIDATION'
	status = 400

	constructor(
		public type: string,
		public validator: TSchema | TypeCheck<any>,
		public value: unknown
	) {
		const error = isProduction
			? undefined
			: 'Errors' in validator
			? validator.Errors(value).First()
			: Value.Errors(validator, value).First()

		const customError = error?.schema.error
			? typeof error.schema.error === 'function'
				? error.schema.error(type, validator, value)
				: error.schema.error
			: undefined

		const message = isProduction
			? customError ??
			  `Invalid ${type ?? error?.schema.error ?? error?.message}`
			: customError ??
			  `Invalid ${type}, '${error?.path?.slice(1) || 'type'}': ${
					error?.message
			  }` +
					'\n\n' +
					'Expected: ' +
					// @ts-ignore
					JSON.stringify(
						ValidationError.simplifyModel(validator),
						null,
						2
					) +
					'\n\n' +
					'Found: ' +
					JSON.stringify(value, null, 2)
		// +
		// '\n\n' +
		// 'Schema: ' +
		// // @ts-ignore
		// JSON.stringify(validator.schema, null, 2) +
		// '\n'

		super(message)

		Object.setPrototypeOf(this, ValidationError.prototype)
	}

	get all() {
		return [...this.validator.Errors(this.value)]
	}

	static simplifyModel(validator: TSchema | TypeCheck<any>) {
		// @ts-ignore
		const model = 'schema' in validator ? validator.schema : validator

		try {
			return Value.Create(model)
		} catch {
			return model
		}
	}

	get model() {
		return ValidationError.simplifyModel(this.validator)
	}

	toResponse(headers?: Record<string, any>) {
		return new Response(this.message, {
			status: 400,
			headers
		})
	}
}
