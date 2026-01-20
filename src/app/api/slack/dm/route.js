import { NextResponse } from 'next/server';
import { sendSlackDM, sendCampaignAssignmentNotification } from '../../../../../lib/slack';

// POST /api/slack/dm - Send a direct message via Slack
export async function POST(request) {
    try {
        const body = await request.json();
        const { slackUserId, message, type, campaignData, customerData } = body;

        if (!slackUserId) {
            return NextResponse.json(
                { error: 'Slack user ID is required' },
                { status: 400 }
            );
        }

        let result;

        if (type === 'campaign-assignment' && campaignData && customerData) {
            // Send campaign assignment notification
            result = await sendCampaignAssignmentNotification(slackUserId, campaignData, customerData);
        } else if (message) {
            // Send custom message
            result = await sendSlackDM(slackUserId, message);
        } else {
            return NextResponse.json(
                { error: 'Either message or campaign assignment data is required' },
                { status: 400 }
            );
        }

        if (result.success) {
            return NextResponse.json({
                success: true,
                channelId: result.channelId,
                messageTs: result.messageTs
            });
        } else {
            return NextResponse.json(
                { error: result.error || 'Failed to send Slack message' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Slack DM API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}