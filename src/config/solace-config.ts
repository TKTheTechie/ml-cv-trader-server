export const solaceConfig = {
  solace_hostUrl: process.env.solace_hostUrl || "wss://mr8gl75znrycq.messaging.solace.cloud:443",
  solace_vpn: process.env.solace_vpn || "ml-cv-trader",
  solace_userName: process.env.solace_userName || "solace-cloud-client",
  solace_password: process.env.solace_password || "b1mqkeh2lf8bc7d2uf9ks2a6kd"
};