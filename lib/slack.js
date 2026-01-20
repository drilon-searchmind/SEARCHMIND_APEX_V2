import { WebClient } from '@slack/web-api';

// Initialize Slack client with bot token from environment
const slackClient = new WebClient(process.env.SLACK_BOT_USER_OAUTH_TOKEN);

/**
 * Send a direct message to a Slack user
 * @param {string} slackUserId - The Slack user ID (not the internal user ID)
 * @param {string} message - The message to send
 * @returns {Promise<Object>} - Slack API response
 */
export async function sendSlackDM(slackUserId, message) {
    try {
        console.log('Attempting to send Slack DM to user:', slackUserId);
        console.log('Using token type:', process.env.SLACK_BOT_USER_OAUTH_TOKEN ? 'Bot Token' : 'Unknown');

        // First, open a DM channel with the user
        const channelResponse = await slackClient.conversations.open({
            users: slackUserId
        });

        console.log('Channel open response:', channelResponse);

        if (!channelResponse.ok) {
            throw new Error(`Failed to open DM channel: ${channelResponse.error}`);
        }

        const channelId = channelResponse.channel.id;
        console.log('Opened channel:', channelId);

        // Send the message to the DM channel
        const messageResponse = await slackClient.chat.postMessage({
            channel: channelId,
            text: message,
            // You can add more formatting options here
            mrkdwn: true // Enable markdown formatting
        });

        console.log('Message send response:', messageResponse);

        if (!messageResponse.ok) {
            throw new Error(`Failed to send message: ${messageResponse.error}`);
        }

        return {
            success: true,
            channelId,
            messageTs: messageResponse.ts
        };

    } catch (error) {
        console.error('Error sending Slack DM:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send campaign assignment notification to a user
 * @param {string} slackUserId - The Slack user ID
 * @param {Object} campaignData - Campaign information
 * @param {Object} customerData - Customer information
 * @param {string} customerId - Customer ID for the link
 * @returns {Promise<Object>} - Result of the DM send
 */
export async function sendCampaignAssignmentNotification(slackUserId, campaignData, customerData, customerId) {
    const campaignUrl = `https://apex.searchmind.tech/dashboard/${customerId}/campaign-planner`;

    const message = `*🎯 Campaign Assignment Alert!*

You've been assigned to a new campaign:

*Customer:* ${customerData?.customerName || 'Unknown Customer'}
*Campaign:* ${campaignData.campaignName}
*Service:* ${campaignData.service}
*Media:* ${campaignData.media || 'N/A'}
*Format:* ${campaignData.campaignFormat || 'N/A'}
*Budget:* ${campaignData.budget ? `${campaignData.budget.toLocaleString()} DKK` : 'N/A'}
*Date Range:* ${campaignData.startDate ? new Date(campaignData.startDate).toLocaleDateString('da-DK') : 'N/A'} - ${campaignData.endDate ? new Date(campaignData.endDate).toLocaleDateString('da-DK') : 'N/A'}

*Message:* ${campaignData.messageBrief || 'No additional details provided.'}

<${campaignUrl}|View the campaign here>

Please review the campaign details and let us know if you have any questions!`;

    return await sendSlackDM(slackUserId, message);
}