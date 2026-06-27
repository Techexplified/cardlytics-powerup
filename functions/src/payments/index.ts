import { PaymentProvider } from "./PaymentProvider";
import { PaddleProvider } from "./PaddleProvider";
import { env } from "../config/env";

export function getPaymentProvider(): PaymentProvider {
  const provider = env.PAYMENT_PROVIDER;

  if (provider === "paddle") return new PaddleProvider();

  // here we can add more providers
  throw new Error(`Unknown payment provider:${provider}`);
}



