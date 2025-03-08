import { z } from 'zod'
import { Agent, type Capability } from '@openserv-labs/sdk'
import { getTools, type ToolBase } from '@goat-sdk/core';
import { debridge } from "@goat-sdk/plugin-debridge";
import { viem } from '@goat-sdk/wallet-viem';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import 'dotenv/config'

if (!process.env.WALLET_PRIVATE_KEY) {
  throw new Error('WALLET_PRIVATE_KEY is not set')
}

if (!process.env.RPC_PROVIDER_URL) {
  throw new Error('RPC_PROVIDER_URL is not set')
}

// Using default DeBridge API URL
const debridgePlugin = debridge();

// Configure the wallet client
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  transport: http(process.env.RPC_PROVIDER_URL),
  chain: mainnet,
});

// Create the agent
const agent = new Agent({
  systemPrompt: 'You are an agent that bridges USDC from Ethereum to Base using deBridge GOAT Plugin',
})

const toCapability = (tool: ToolBase) => {
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.parameters,
    async run({ args }) {
      const response = await tool.execute(args)

      if (typeof response === 'object') {
        return JSON.stringify(response, null, 2)
      }

      return response.toString()
    }
  } as Capability<typeof tool.parameters>
}


async function main() {
  const wallet = viem(walletClient)

  const tools = await getTools({
    wallet,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    plugins: [debridgePlugin]
  })

  const address = wallet.getAddress()

  try {
    const capabilities = tools.map(toCapability) as [Capability<z.ZodTypeAny>, ...Capability<z.ZodTypeAny>[]]

    agent.addCapabilities(capabilities)

    await agent.start()
  } catch (error) {
    console.error(error)
  }
}

main()
