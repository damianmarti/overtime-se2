import { NextResponse } from "next/server";

export async function GET() {
  const networkId = 10;
  const url = `https://api.overtime.io/overtime-v2/networks/${networkId}/markets`;
  const apiKey = process.env.OVERTIME_API_KEY || "";

  try {
    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch markets" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching markets:", error);
    return NextResponse.json({ error: "API error" }, { status: 500 });
  }
}
