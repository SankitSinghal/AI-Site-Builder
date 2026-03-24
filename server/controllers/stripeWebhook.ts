import { Request, Response } from "express";
import Stripe from "stripe";
import prisma from "../lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const stripeWebhook = async (req: Request, res: Response) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    );
  } catch (err: any) {
    console.log(" Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      // CORRECT EVENT FOR CHECKOUT
      case "checkout.session.completed": {

        const session = event.data.object as Stripe.Checkout.Session;

        const metadata = session.metadata as {
          transactionId: string;
          appId: string;
        };

        if (!metadata || metadata.appId !== "AI-Site-Builder") {
          console.log("Invalid metadata");
          break;
        }

        const { transactionId } = metadata;

        if (!transactionId) {
          console.log("Missing transactionId");
          break;
        }

        const transaction = await prisma.transaction.update({
          where: { id: transactionId },
          data: { isPaid: true },
        });

        // Add credits to user
        await prisma.user.update({
          where: { id: transaction.userId },
          data: {
            credits: {
              increment: transaction.credits,
            },
          },
        });

        console.log("Payment successful & credits added");
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error: any) {
    console.log("Webhook processing error:", error.message);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};