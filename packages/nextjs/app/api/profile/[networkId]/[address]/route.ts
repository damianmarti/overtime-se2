import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ networkId: string; address: string }> }) {
  const { networkId, address } = await params;
  const url = `https://api.overtime.io/overtime-v2/networks/${networkId}/users/${address}/history`;

  try {
    const response = await fetch(url, {
      headers: {
        "x-api-key": process.env.OVERTIME_API_KEY || "",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch user profile" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching user history:", error);
    return NextResponse.json({ error: "API error" }, { status: 500 });
  }
}
