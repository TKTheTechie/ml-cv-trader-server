# ml-cv-trader-server

ml-cv-trader - short for 'machine learning-computer vision-trader' - is a a demo/experiment that
runs gesture recognition from your webcam's video stream in order to determine whether to buy or
sell stocks while consuming a simulated market data feed over Solace PubSub+ and sending the end
result back to Solace for processing on the server side.

## Installing 

This project uses an express server & typescript. Install it and the associated dependencies by running the following command:

```bash
npm install
```

## Configuring the server with a Solace PubSub+ Broker

Spin up a Solace PubSub+ broker [container](https://solace.com/products/event-broker/software/getting-started/) or [in the cloud](https://docs.solace.com/Cloud/ggs_signup.htm).

Modify `./config/solace-config.ts` with the appropriate username and credentials. If using Solace Cloud, you can retrieve the credentials from the Web Messaging section of the Connect Tab of a Solace cloud instance as shown below:

![Solace-WS](solace-ws-connection-example.png)



## Developing

Once you've installed dependencies with `npm install`, start a development server using the following command:

```bash
npm serve
```

## Building

To create a production version of this app:

```bash
npm run tsc
npm run start:prod
```

## Running the server side component
A svelte js ui component is required for this demo -  ml-cv-trader-ui. Visit the repo to setup and run.