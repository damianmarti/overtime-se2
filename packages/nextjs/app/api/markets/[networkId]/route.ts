import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ networkId: string }> }) {
  const { networkId } = await params;
  const url = `https://api.overtime.io/overtime-v2/networks/${networkId}/markets`;
  const apiKey = process.env.OVERTIME_API_KEY || "";

  console.log(`📡 Fetching markets for network ${networkId} from: ${url}`);
  console.log(`🔑 API Key present: ${apiKey ? "Yes" : "No"}`);

  try {
    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    console.log(`📊 API Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API request failed: ${response.status} - ${errorText}`);
      return NextResponse.json({ error: "Failed to fetch markets" }, { status: response.status });
    }

    const data = await response.json();
    const sportCount = Object.keys(data).length;
    console.log(`✅ Markets fetched successfully: ${sportCount} sports`);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Error fetching markets:", error);
    return NextResponse.json({ error: "API error" }, { status: 500 });
  }
}
