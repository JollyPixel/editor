// Import Third-party Dependencies
import type { FastifyRequest } from "fastify";

export type RequestScoped<T> = (request: FastifyRequest) => T;
