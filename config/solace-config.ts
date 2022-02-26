export const solaceConfig = {
  solace_hostUrl: process.env.solace_hostUrl || "ws://localhost:8008",
  solace_vpn: process.env.solace_vpn || "default",
  solace_userName: process.env.solace_userName || "default",
  solace_password: process.env.solace_password || "default"
};