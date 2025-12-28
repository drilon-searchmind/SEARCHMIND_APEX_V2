import { searchconsole } from '@googleapis/searchconsole';
import { GoogleAuth } from 'google-auth-library';

export function getServiceAccountCredentials() {
    try {
        const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS;
        if (!raw) throw new Error('Missing GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS');
        return JSON.parse(raw);
    } catch (e) {
        throw new Error('Invalid GOOGLE_ADS_SERVICE_ACCOUNT_CREDENTIALS: ' + e.message);
    }
}

export async function getSearchConsoleClient() {
    const credentials = getServiceAccountCredentials();
    const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const client = await auth.getClient();
    return searchconsole({ version: 'v1', auth: client });
}
