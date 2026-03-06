const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

// Proxy details
const proxyString = "108.165.210.2:12323:14a383f5ee52b:21d614715f";
const [host, port, username, password] = proxyString.split(":");

// Function to test proxy
async function testProxy() {
  const proxyConfig = {
    protocol: "http",
    host: host,
    port: port,
    auth: {
      username: username,
      password: password,
    },
  };

  const httpsAgent = new HttpsProxyAgent(
    `http://${username}:${password}@${host}:${port}`,
  );

  try {
    console.log("Testing proxy...");
    const response = await axios.get("http://httpbin.org/ip", {
      httpsAgent: httpsAgent,
      proxy: false, // Disable axios' default proxy handling
      timeout: 10000, // 10 seconds timeout
    });

    console.log("Proxy is valid!");
    console.log(
      `Your IP address through the proxy is: ${response.data.origin}`,
    );
    return true;
  } catch (error) {
    console.error("Proxy test failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return false;
  }
}

// Run the test
testProxy();
