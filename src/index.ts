import 'dotenv/config';
import { Agent } from "./agent";
async function main() {
    try {
        const agents = [];
        const agent = new Agent();
        agents.push(agent);

        // Wait for all agents to complete using Promise.all
        await Promise.all(agents.map(async (agent) => {
            try {
                await agent.start();
            } catch (error) {
                console.error(`Error starting agent: ${error} ${error.stack}`);
            }
        }));

        console.log("All agents completed successfully");
    } catch (error) {
        console.error("Fatal error in main:", error);
        process.exit(1);
    }
}

// Execute main function
main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
});

