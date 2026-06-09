import { NextResponse } from "next/server";
import {
  verifyAuthToken,
  verifyErrorMessage,
  isAdminSdkConfigured,
  adminDb,
  getAdminStorageBucket,
} from "@/lib/firebase-admin";

function storagePathFromUrl(url: string): string | null {
  const match = url.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function deleteStorageFiles(fileUrls: string[]) {
  const bucket = getAdminStorageBucket();
  await Promise.all(
    fileUrls.map(async (url) => {
      const path = storagePathFromUrl(url);
      if (!path) return;
      try {
        await bucket.file(path).delete();
      } catch {
        // ignore if already deleted
      }
    })
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  if (!isAdminSdkConfigured()) {
    return NextResponse.json(
      { error: "서버 설정이 완료되지 않았습니다. 관리자에게 문의하세요." },
      { status: 503 }
    );
  }

  const auth = await verifyAuthToken(request.headers.get("Authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: verifyErrorMessage(auth) }, { status: 403 });
  }

  const { reportId } = await params;
  const reportRef = adminDb.collection("weeklyReports").doc(reportId);
  const snap = await reportRef.get();

  if (!snap.exists) {
    return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
  }

  const data = snap.data()!;
  if (data.userId !== auth.uid && auth.role !== "admin") {
    return NextResponse.json({ error: "본인이 작성한 보고서만 삭제할 수 있습니다." }, { status: 403 });
  }

  try {
    const fileUrls = Array.isArray(data.fileUrls) ? (data.fileUrls as string[]) : [];
    await deleteStorageFiles(fileUrls);
    await reportRef.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "delete failed";
    return NextResponse.json({ error: `삭제에 실패했습니다. (${detail})` }, { status: 500 });
  }
}
