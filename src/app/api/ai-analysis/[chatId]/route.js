import { NextResponse } from 'next/server';
import dbConnect from "../../../../../lib/mongodb";
import AiAnalysisChat from '@/models/AiAnalysisChat';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// GET /api/ai-analysis/[chatId] - Get a specific chat
export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const chatId = resolvedParams.chatId;

        await dbConnect();

        const chat = await AiAnalysisChat.findOne({
            _id: chatId
        }).lean();

        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        return NextResponse.json(chat);
    } catch (error) {
        console.error('Error fetching chat:', error);
        return NextResponse.json(
            { error: 'Failed to fetch chat' },
            { status: 500 }
        );
    }
}

// POST /api/ai-analysis/[chatId] - Send a message to AI
export async function POST(request, { params }) {
    try {
        const resolvedParams = await params;
        const chatId = resolvedParams.chatId;
        const body = await request.json();
        const { message } = body;

        if (!message || !message.trim()) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        await dbConnect();

        const chat = await AiAnalysisChat.findOne({
            _id: chatId
        });

        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        // Add user message
        chat.messages.push({
            type: 'user',
            content: message,
            timestamp: new Date()
        });

        // Prepare context for AI
        const systemPrompt = `You are an expert data analyst helping business owners understand their performance metrics. 
You have access to their dashboard data for the period ${chat.dateRange.startDate} to ${chat.dateRange.endDate}.

Data snapshot:
${JSON.stringify(chat.dataSnapshot, null, 2)}

Comparison method: ${chat.comparisonMethod}

Provide clear, actionable insights. Use specific numbers from the data. Be concise but thorough.`;

        // Build conversation history for context
        const messages = [
            { role: 'system', content: systemPrompt },
            ...chat.messages.slice(-10).map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content
            }))
        ];

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        });

        const aiResponse = completion.choices[0].message.content;
        const tokensUsed = completion.usage.total_tokens;

        // Add AI message
        chat.messages.push({
            type: 'ai',
            content: aiResponse,
            timestamp: new Date(),
            tokensUsed: tokensUsed,
            model: 'gpt-4o-mini'
        });

        await chat.save();

        return NextResponse.json({
            type: 'ai',
            content: aiResponse,
            timestamp: new Date(),
            tokensUsed
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json(
            { error: 'Failed to send message' },
            { status: 500 }
        );
    }
}

// DELETE /api/ai-analysis/[chatId] - Archive a chat
export async function DELETE(request, { params }) {
    try {
        const resolvedParams = await params;
        const chatId = resolvedParams.chatId;

        await dbConnect();

        const chat = await AiAnalysisChat.findOneAndUpdate(
            {
                _id: chatId
            },
            { status: 'archived' },
            { new: true }
        );

        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Chat archived successfully' });
    } catch (error) {
        console.error('Error archiving chat:', error);
        return NextResponse.json(
            { error: 'Failed to archive chat' },
            { status: 500 }
        );
    }
}
