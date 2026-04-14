import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@root/lib/mongodb';
import { getCustomerById } from '@root/lib/customerOperations';
import CampaignPlannerComment from '@/models/CampaignPlannerComment';

async function assertCustomerAccess(session, customerId) {
	const customer = await getCustomerById(customerId);
	if (session.user.isExternal) {
		const sharedIds = (session.user.sharedCustomers || []).map((id) => String(id));
		if (!sharedIds.includes(String(customerId))) {
			const err = new Error('Forbidden');
			err.statusCode = 403;
			throw err;
		}
	}
	return customer;
}

function serializeComment(doc) {
	return {
		id: String(doc._id),
		text: doc.text,
		createdAt: doc.createdAt,
		userName: doc.userName || '',
		userImage: doc.userImage || '',
		userId: String(doc.userId),
	};
}

export async function GET(request, { params }) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const resolvedParams = await params;
	const customerId = resolvedParams.customerId;
	if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
		return Response.json({ error: 'Invalid customer id' }, { status: 400 });
	}

	const lineItemId = new URL(request.url).searchParams.get('lineItemId');
	if (!lineItemId || !String(lineItemId).trim()) {
		return Response.json({ error: 'Missing lineItemId' }, { status: 400 });
	}

	try {
		await connectToDatabase();
		try {
			await assertCustomerAccess(session, customerId);
		} catch (accessErr) {
			if (accessErr.statusCode === 403) {
				return Response.json({ error: 'Forbidden' }, { status: 403 });
			}
			if (String(accessErr.message || '').toLowerCase().includes('not found')) {
				return Response.json({ error: 'Customer not found' }, { status: 404 });
			}
			throw accessErr;
		}

		const rows = await CampaignPlannerComment.find({
			customerId,
			lineItemId: String(lineItemId).trim(),
		})
			.sort({ createdAt: 1 })
			.lean();

		return Response.json({
			comments: rows.map((r) => serializeComment(r)),
		});
	} catch (error) {
		console.error('campaign-planner comments GET:', error);
		return Response.json(
			{ error: error.message || 'Failed to load comments' },
			{ status: 500 }
		);
	}
}

export async function POST(request, { params }) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const resolvedParams = await params;
	const customerId = resolvedParams.customerId;
	if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
		return Response.json({ error: 'Invalid customer id' }, { status: 400 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const lineItemId = body?.lineItemId != null ? String(body.lineItemId).trim() : '';
	const text = body?.text != null ? String(body.text).trim() : '';
	if (!lineItemId) {
		return Response.json({ error: 'lineItemId is required' }, { status: 400 });
	}
	if (!text) {
		return Response.json({ error: 'text is required' }, { status: 400 });
	}
	if (text.length > 8000) {
		return Response.json({ error: 'Comment is too long' }, { status: 400 });
	}

	try {
		await connectToDatabase();
		try {
			await assertCustomerAccess(session, customerId);
		} catch (accessErr) {
			if (accessErr.statusCode === 403) {
				return Response.json({ error: 'Forbidden' }, { status: 403 });
			}
			if (String(accessErr.message || '').toLowerCase().includes('not found')) {
				return Response.json({ error: 'Customer not found' }, { status: 404 });
			}
			throw accessErr;
		}

		const userId = session.user.id;
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return Response.json({ error: 'Invalid user session' }, { status: 400 });
		}

		const doc = await CampaignPlannerComment.create({
			customerId,
			lineItemId,
			userId,
			userName: session.user.name || session.user.email || 'User',
			userImage: typeof session.user.image === 'string' ? session.user.image : '',
			text,
		});

		const lean = doc.toObject();
		return Response.json({ comment: serializeComment(lean) });
	} catch (error) {
		console.error('campaign-planner comments POST:', error);
		return Response.json(
			{ error: error.message || 'Failed to save comment' },
			{ status: 500 }
		);
	}
}
