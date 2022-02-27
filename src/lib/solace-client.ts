import { solaceConfig } from '../config/solace-config';
import solace, {  MessageConsumer,  Session,  SessionEvent  } from 'solclientjs';
import { log } from './logger';
import { Blob } from 'buffer';


/**
 * The SubscriptionObject represents a combination of the callback function and
 *  whether the subscription has been applied on the PubSub+ broker
 *  @author TKTheTechie
 */
 class SubscriptionObject {
   callback: any;
   isSubscribed: boolean;
   isReply: boolean;

  constructor(callback: any, isSubscribed: boolean, isReply?:boolean) {
    this.callback = callback;
    this.isSubscribed = isSubscribed;
    this.isReply = isReply || false;
  }
}

/**
 * The QueueConsumerObject represents a combination of the MessageConsumer and whether the consumer session is active
 * @author TKTheTechie
 */
class QueueConsumerObject {
  messageConsumer: MessageConsumer;
  isConsuming: boolean;

  constructor(messageConsumer: MessageConsumer, isConsuming: boolean) {
    this.messageConsumer = messageConsumer;
    this.isConsuming = isConsuming;
  }

}


export class SolaceClient {
  //Solace session object
  private session: Session = null;
  
  //Map that holds the topic subscription string and the associated callback function, subscription state
  private topicSubscriptions: Map<String, SubscriptionObject> = new Map<String, SubscriptionObject>();

  //Map that holds the queue subscription string and the associated callback function, subscription state
  private queueSubscriptions: Map<String, QueueConsumerObject> = new Map<String, QueueConsumerObject>();

  

  
  constructor() {
    //Initializing the solace client library
    let factoryProps = new solace.SolclientFactoryProperties();
    factoryProps.profile = solace.SolclientFactoryProfiles.version10;
    solace.SolclientFactory.init(factoryProps);
  }
  /**
   * Asynchronous function that connects to the Solace Broker and returns a promise.
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.session !== null) {
       log.warn("Already connected and ready to subscribe.");
        reject();
      }
      // if there's no session, create one with the properties imported from the game-config file
      try {
        if (solaceConfig.solace_hostUrl.indexOf("ws") != 0) {
          reject("HostUrl must be the WebMessaging Endpoint that begins with either ws:// or wss://. Please check your game-config.ts!");
        }


        this.session = solace.SolclientFactory.createSession({
          url: solaceConfig.solace_hostUrl,
          vpnName: solaceConfig.solace_vpn,
          userName: solaceConfig.solace_userName,
          password: solaceConfig.solace_password,
          connectRetries: 3,
          publisherProperties: {
            enabled:true,
            acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE
          }
        });
        
      } catch (error) {
        log.error(error.toString());
      }
      // define session event listeners

      

      //The UP_NOTICE dictates whether the session has been established
      this.session.on(solace.SessionEventCode.UP_NOTICE, (sessionEvent:SessionEvent) => {
        log.info("=== Successfully connected and ready to subscribe. ===");
        resolve('Connected');
      });

      //The CONNECT_FAILED_ERROR implies a connection failure
      this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (sessionEvent:SessionEvent)  => {
        log.error("Connection failed to the message router: " + sessionEvent.infoStr + " - check correct parameter values and connectivity!");
        reject(`Check the settings in game-config.ts and try again!`);
      });

      //DISCONNECTED implies the client was disconnected
      this.session.on(solace.SessionEventCode.DISCONNECTED, (sessionEvent:SessionEvent)  => {
        log.info("Disconnected.");
        if (this.session !== null) {
          this.session.dispose();
          this.session = null;
        }
        //Update the status of the solace store
      });

      //ACKNOWLEDGED MESSAGE implies that the broker has confirmed message receipt
      this.session.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, (sessionEvent:SessionEvent)  => {
        log.info("Delivery of message with correlation key = " + sessionEvent.correlationKey + " confirmed.");
      });

      //REJECTED_MESSAGE implies that the broker has rejected the message
      this.session.on(solace.SessionEventCode.REJECTED_MESSAGE_ERROR, (sessionEvent:SessionEvent)  => {
        log.info("Delivery of message with correlation key = " + sessionEvent.correlationKey + " rejected, info: " + sessionEvent.infoStr);
      });

      //SUBSCRIPTION ERROR implies that there was an error in subscribing on a topic
      this.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, (sessionEvent:SessionEvent)  => {
        log.info("Cannot subscribe to topic: " + sessionEvent.correlationKey);
        //remote the topic from the TopicSubscriptionMap
        this.topicSubscriptions.delete(String(sessionEvent.correlationKey));
      });

      //SUBSCRIPTION_OK implies that a subscription was succesfully applied/removed from the broker
      this.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, sessionEvent => {
        log.info(`Session co-relation-key for event: ${sessionEvent.correlationKey}`);

        let topicStr = String(sessionEvent.correlationKey);

        //Check if the topic exists in the map
        if (this.topicSubscriptions.get(topicStr)) {
          //If the subscription shows as subscribed, then this is a callback for unsubscripition
          if (this.topicSubscriptions.get(topicStr).isSubscribed) {
            //Remove the topic from the map
            this.topicSubscriptions.delete(topicStr);
            log.info(`Successfully unsubscribed from topic: ${sessionEvent.correlationKey}`);
          } else {
            //Otherwise, this is a callback for subscribing
            this.topicSubscriptions.get(topicStr).isSubscribed = true;
            log.info(`Successfully subscribed to topic: ${sessionEvent.correlationKey}`);
          }
        }
      });

     //Message callback function
     this.session.on(solace.SessionEventCode.MESSAGE, message => {
      //Get the topic name from the message's destination
      let topicName: string = message.getDestination().getName();

      //Iterate over all subscriptions in the subscription map
       for (let sub of Array.from(this.topicSubscriptions.keys())) {
         
        //Replace all * in the topic filter with a .* to make it regex compatible
        let regexdSub = sub.replace(/\*/g, ".*");

        //if the last character is a '>', replace it with a .* to make it regex compatible
        if (sub.lastIndexOf(">") == sub.length - 1) regexdSub = regexdSub.substring(0, regexdSub.length - 1).concat(".*");

        let matched = topicName.match(regexdSub);

        //if the matched index starts at 0, then the topic is a match with the topic filter
        if (matched && matched.index == 0) {
          //Edge case if the pattern is a match but the last character is a *
          if (regexdSub.lastIndexOf("*") == sub.length - 1) {
            //Check if the number of topic sections are equal
            if (regexdSub.split("/").length != topicName.split("/").length) return;
          }
          //Proceed with the message callback for the topic subscription if the subscription is active
          if (this.topicSubscriptions.get(sub).isSubscribed && this.topicSubscriptions.get(sub).callback != null) {
            log.info(`Got callback for ${sub}`);
            if (!this.topicSubscriptions.get(sub).isReply)
              this.topicSubscriptions.get(sub).callback(message);
            else {
              this.topicSubscriptions.get(sub).callback(message).then((replyMsg: solace.Message) => {
                this.session.sendReply(message, replyMsg);
            });
            }
          }
        }
      }
    });
      // connect the session
      try {
        this.session.connect();
      } catch (error) {
        log.info(error.toString());
      }
    });
  }

  disconnect() {
    log.info("Disconnecting from Solace message router...");
    if (this.session !== null) {
      try {
        this.session.disconnect();
      } catch (error) {
        log.error(error.toString());
      }
    } else {
      log.error("Not connected to Solace message router.");
    }
  }

  
  unsubscribe(topicName: String) {
    if (!this.session) {
     log.warn("[WARNING] Cannot subscribe because not connected to Solace message router!");
      return;
    }

  
    log.info(`Unsubscribing from ${topicName}...`);
    this.session.unsubscribe(solace.SolclientFactory.createTopicDestination(topicName.toString()), true, topicName ,1000);
  }

  /**
   * Function that subscribes to the topic
   * @param topicName Topic string for the subscription
   * @param callback Callback for the function
   */
   subscribe(topicName: String, callback: any, isReply?:boolean) {
    //Check if the session has been established
    if (!this.session) {
      log.warn("Cannot subscribe because not connected to Solace message router!");
      return;
    }
    //Check if the subscription already exists
    if (this.topicSubscriptions.get(topicName)) {
      log.warn(`Already subscribed to ${topicName}.`);
      return;
    }
    log.info(`Subscribing to ${topicName}`);
    //Create a subscription object with the callback, upon succesful subscription, the object will be updated
    let subscriptionObject: SubscriptionObject = new SubscriptionObject(callback, false, isReply);
    this.topicSubscriptions.set(topicName, subscriptionObject);
    try {
      //Session subscription
      this.session.subscribe(
        solace.SolclientFactory.createTopicDestination(topicName.toString()),
        true, // generate confirmation when subscription is added successfully
        topicName, // use topic name as correlation key
        10000 // 10 seconds timeout for this operation
      );
    } catch (error) {
      log.error(error.toString());
    }
   }
  
  /**
   * Convenience function to consume from a queue
   * 
   * @param queueName Name of the queue to consume from
   * @param callback The callback function for the message receipt
   */
  consumeFromQueue(queueName: string,  subscriptions:String[],callback: any,) {
    if (this.session == null) {
      log.error("Not connected to Solace!");
    } else {
      if (this.queueSubscriptions.get(queueName) && this.queueSubscriptions.get(queueName).isConsuming)
        log.warn("Already connected to the queue");
      else {

        let messageConsumer= this.session.createMessageConsumer({
          queueDescriptor: { name: queueName, type: solace.QueueType.QUEUE },
          acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT,
          createIfMissing: true
        });
        
    

        let queueConsumerObject = new QueueConsumerObject(messageConsumer, false);
        this.queueSubscriptions.set(queueName, queueConsumerObject);

        messageConsumer.on(solace.MessageConsumerEventName.UP, () => {
          queueConsumerObject.isConsuming = true;
          log.info("Succesfully connected to an consuming from " + queueName);
        });

        messageConsumer.on(solace.MessageConsumerEventName.CONNECT_FAILED_ERROR, () => {
          queueConsumerObject.isConsuming = false;
          log.error("Consumer cannot bind to queue " + queueName);
        });

        messageConsumer.on(solace.MessageConsumerEventName.DOWN, () => {
          queueConsumerObject.isConsuming = false;
          log.error("The message consumer is down");
        });

        messageConsumer.on(solace.MessageConsumerEventName.DOWN_ERROR, () => {
          queueConsumerObject.isConsuming = false;
          log.error("An error happend, the message consumer is down");
        });

        messageConsumer.on(solace.MessageConsumerEventName.MESSAGE, (message: solace.Message) => {
          callback(message);
          message.acknowledge();
        });

        try {
          messageConsumer.connect();
          subscriptions.forEach(sub => {
            log.info("Adding subscription " + sub + " to " + queueName);
            messageConsumer.addSubscription(solace.SolclientFactory.createTopicDestination(sub.toString()), sub, 1000);
          });
          

        } catch(err) {
          log.error("Cannot start the message consumer on queue "+ queueName + " because: "+ err);
        }
      }
      
    }
  }

  /**
   * 
   * @param queueName Name of the queue to consume from
   */
  stopConsumeFromQueue(queueName: string) {
    if (this.queueSubscriptions.get(queueName) == null) {
      log.error(queueName + " is currently not being subscribed to");
    } else {
      if (this.queueSubscriptions.get(queueName).isConsuming) {
        this.queueSubscriptions.get(queueName).messageConsumer.stop();
        this.queueSubscriptions.get(queueName).isConsuming = false;
      }
    }
  }
  
  /**
   * Publish a message on a topic
   * @param topic Topic to publish on
   * @param payload Payload on the topic
   */
  publishDirect(topic: string, payload: string) {
    if (!this.session) {
      log.warn("[WARNING] Cannot publish because not connected to Solace message router!");
      return;
    }

    const binaryAttachment = new Blob([payload], { type: 'text/plain; charset=utf-8' }).arrayBuffer();

    log.debug(`Publishing message ${payload} to topic ${topic}...`);
    let message = solace.SolclientFactory.createMessage();
    message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
    message.setElidingEligible(true);
    binaryAttachment.then(buffer => {
      message.setBinaryAttachment(new Uint8Array(buffer));
      message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
      try {
        this.session.send(message);
        log.debug("Message published.");
      } catch (error) {
        log.info(error.toString());
      }
    })
  }


}