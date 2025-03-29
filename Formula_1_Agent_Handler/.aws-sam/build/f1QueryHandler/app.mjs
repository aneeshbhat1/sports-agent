import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockClient } from "@aws-sdk/client-bedrock";

// Initialize the clients
const client = new BedrockAgentRuntimeClient({ 
    region: "us-east-1",
    logger: console 
});

const bedrockClient = new BedrockClient({ region: "us-east-1" });

function decodeChunk(chunk) {
    try {
        if (!chunk) return null;

        // Handle error chunks
        if (chunk.headers[':message-type']?.value === 'exception') {
            const errorMessage = JSON.parse(Buffer.from(chunk.body).toString());
            throw new Error(`Bedrock error: ${errorMessage.message}`);
        }

        // Handle JSON chunks
        if (chunk.headers[':content-type']?.value === 'application/json') {
            const jsonChunk = JSON.parse(Buffer.from(chunk.body).toString());
            if (jsonChunk.bytes) {
                return Buffer.from(jsonChunk.bytes, 'base64').toString('utf-8');
            }
        }
        
        // Handle direct byte chunks
        if (chunk.chunk?.bytes) {
            return Buffer.from(chunk.chunk.bytes).toString('utf-8');
        }

        return null;
    } catch (error) {
        console.error('Error decoding chunk:', error);
        console.log('Problematic chunk:', chunk);
        throw error; // Re-throw to be handled by main error handler
    }
}

export const handler = async (event) => {
    const headers = {
		"Access-Control-Allow-Origin": "http://localhost:3000",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
		"Content-Type": "application/json"
	};

    if (event.httpMethod === 'OPTIONS') {
        return { 
            statusCode: 200, 
            headers, 
            body: '' 
        };
    }

    try {
        const body = JSON.parse(event.body);
        const userQuery = body.query;

        if (!userQuery) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: "Query is required in request body"
                })
            };
        }

        const input = {
            agentId: "OM17ZHIBGC",
            agentAliasId: "PDCSW5QRNG",
            sessionId: `session-${Date.now()}`,
            inputText: userQuery
        };

        console.log('Sending request to Bedrock:', JSON.stringify(input, null, 2));

        const command = new InvokeAgentCommand(input);
        const agentResponse = await client.send(command);
		console.log('Agent response:', JSON.stringify(agentResponse, null, 2));

        const chunks = [];
        const stream = agentResponse.completion.options.messageStream;
        
        for await (const chunk of stream) {
            console.log('Processing chunk:', {
                headers: chunk.headers,
                hasBody: !!chunk.body,
                bodyLength: chunk.body?.length,
                hasChunkBytes: !!chunk.chunk?.bytes
            });

            try {
                const decodedChunk = decodeChunk(chunk);
                if (decodedChunk) {
                    chunks.push(decodedChunk);
                    console.log('Decoded chunk:', decodedChunk);
                }
            } catch (error) {
                if (error.message.includes('Bedrock error:')) {
                    throw error; // Propagate Bedrock errors
                }
                console.error('Error processing chunk:', error);
                // Continue processing other chunks if this one fails
            }
        }

        const combinedResponse = chunks.join('');
        console.log('Combined response:', combinedResponse);
		// if (agentResponse.completion === undefined) {
		// 	throw new Error("Completion is undefined");
		//   }
	  
		//   for await (const chunkEvent of agentResponse.completion) {
		// 	const chunk = chunkEvent.chunk;
		// 	console.log(chunk);
		// 	const decodedResponse = new TextDecoder("utf-8").decode(chunk.bytes);
		// 	completion += decodedResponse;
		//   }
		//   console.log('Full response:', completion);
	  

        // if (!combinedResponse) {
        //     throw new Error('No valid response received from Bedrock');
        // }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                message: combinedResponse,
                chunkCount: chunks.length
            })
        };

    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack,
            metadata: error.$metadata
        });

        let statusCode = 500;
        let errorMessage = "Error processing your request";

        // Handle specific error types
        if (error.code === 'AccessDeniedException') {
            statusCode = 403;
            errorMessage = "Access denied to Bedrock service";
        } else if (error.message.includes('Bedrock error:')) {
            statusCode = 400;
            errorMessage = error.message;
        } else if (error.name === 'ValidationException') {
            statusCode = 400;
            errorMessage = "Invalid request parameters";
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                message: errorMessage,
                error: error.message,
                errorCode: error.code,
                requestId: error.$metadata?.requestId
            })
        };
    }
};
