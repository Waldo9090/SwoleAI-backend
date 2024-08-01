const express = require('express');
const cookieParser = require('cookie-parser');
const stripe = require('stripe')('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');
const app = express();

app.use(express.json());
app.use(cookieParser()); // Add this line to use cookie-parser middleware

// Example in-memory storage (for demonstration purposes)
const emailToCustomerId = {};

// Create or retrieve Stripe customer
app.post('/create-customer', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the customer already exists
    let customerId = emailToCustomerId[email];
    
    if (customerId) {
        return res.json({ customerId });
    }

    try {
        // Create a new Stripe customer
        const customer = await stripe.customers.create({ email });
        emailToCustomerId[email] = customer.id; // Store the customer ID

        res.json({ customerId: customer.id });
    } catch (error) {
        console.error('Error creating Stripe customer:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to handle startup requests
app.get('/startup', (req, res) => {
    console.log('Startup request received');
    res.status(200).send('Server booted up successfully!');
});

app.post('/check-subscription', async (req, res) => {
  const { customerId } = req.body;
  const priceId = 'price_1Pj403Rt7WmPsSIVQXx44rG3';

  try {
    // Retrieve customer
    const customer = await stripe.customers.retrieve(customerId);

    // Check subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active', // Only check active subscriptions
    });

    // Check if any subscription has the specified price ID
    const hasSubscription = subscriptions.data.some(subscription =>
      subscription.items.data.some(item => item.price.id === priceId)
    );

    res.json({ hasSubscription });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/create-payment-intent', async (req, res) => {
    const { customerId, priceId } = req.body;

    try {
        // Create a PaymentIntent with the priceId
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1000, // Amount in cents. This will be overridden by the priceId.
            currency: 'usd', // Replace with your currency
            customer: customerId,
            payment_method_types: ['card'],
            description: 'Subscription Payment',
            // Use the priceId to set up the subscription
            metadata: { priceId }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/create-subscription', async (req, res) => {
  const { customerId, priceId } = req.body;

  if (!customerId || !priceId) {
    return res.status(400).send({ error: { message: 'Missing required parameters' } });
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 3, // Set the trial period
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice'],
      trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } }, // Handle trial period behavior
    });

    if (subscription.latest_invoice) {
      res.send({
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.client_secret,
      });
    } else {
      console.error('Missing latest_invoice data:', subscription);
      res.status(400).send({ error: { message: 'Invoice not found' } });
    }
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(400).send({ error: { message: error.message } });
  }
});






app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
