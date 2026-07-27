const webPushDelivery = require('./web-push');

const deliveryChannels = {
  pwa: webPushDelivery,
};

async function send(device, notification) {
  const channel = deliveryChannels[device.device_type];
  if (!channel) {
    throw new Error(`Unknown device type: ${device.device_type}`);
  }
  return channel.send(device, notification);
}

module.exports = { send, channels: deliveryChannels };
