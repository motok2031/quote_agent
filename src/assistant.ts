import OpenAI from "openai";
import { ChatCompletionTool } from "openai/resources";

export async function call_llm<T>(
    model: string,
    sys_prompt: string,
    messages: { role: string; content: string }[],
    tools: ChatCompletionTool[],
    funcs: ((args: any) => Promise<T>)[]): Promise<T> {
    const function_map = {}
    for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        const func = funcs[i];
        function_map[tool.function.name] = func;
    }

    const data: any = {
        model: model,
        messages: [
            { role: 'developer', content: sys_prompt },
            ...messages
        ],
        tools: tools,
        tool_choice: tools.length > 0 ? 'auto' : 'none'
    };
    // console.log("call_llm data",data);
    const gpt = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let response = await gpt.chat.completions.create(data);
    while (response.choices[0].message.tool_calls) {
        data.messages.push(response.choices[0].message);
        for (const toolCall of response.choices[0].message.tool_calls) {
            const function_name = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            const func = function_map[function_name];
            
            const result = await func(args);
            // console.log("function_name",function_name,args,result);
            data.messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result.toString()
            });
        }
        response = await gpt.chat.completions.create(data);
    }
    return response.choices[0].message.content as T;
}