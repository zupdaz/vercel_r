import { NextResponse } from "next/server"
import type { MaterialiRAResult } from "@/lib/types"
import { FEATURES } from "@/lib/settings"

// Mapping for intermediate form values
const intermediateFormRAMapping: Record<string, string> = {
  kapsula: "kapsula",
  "kapsula, mehka": "kapsula",
  "kapsula, trda": "kapsula",
  "polizdelek zmes": "zmes",
  "polizdelek zmes za kaps": "zmes",
  "polizdelek zmes za tbl": "zmes",
  "polizdelek-zmes za placebo": "zmes",
  granulat: "granulat",
  "polizdelek-granulat": "granulat",
  "polizdelek-jedro": "jedro",
  tableta: "tableta",
  "tabl s podaljšanim sprošč": "tableta",
  "tabl s prirejenim sprošč": "tableta",
  "gastrorezistentna tableta": "gastrorezistentna tableta",
  "enterično obložene tablete": "gastrorezistentna tableta",
  raztopina: "raztopina",
  "raztopina za INJ/INF": "raztopina",
}

// Format strength value
function formatStrength(value: string | null): string | null {
  if (!value) return null

  // Convert to lowercase and remove spaces
  const originalValue = value
  let formattedValue = value.toLowerCase().replace(/\s/g, "")

  // Replace "." with ","
  formattedValue = formattedValue.replace(/\./g, ",")

  // Split values by "/"
  const parts = formattedValue.split("/")

  // Process each part to ensure it has the correct format
  const formattedParts: string[] = []
  let unit = "mg" // Default unit

  for (const part of parts) {
    // Extract number and unit
    const match = part.match(/(\d+,\d+|\d+)(mg|g)?/)

    if (match) {
      const [, number, partUnit] = match
      if (partUnit) {
        unit = partUnit
      }
      formattedParts.push(number)
    } else {
      // Unrecognized pattern, return the original string
      return originalValue
    }
  }

  return `${formattedParts.join("/")} ${unit}`
}

export async function POST(request: Request) {
  if (!FEATURES.ENABLE_MATERIALIA_RA_CONNECTION) {
    return NextResponse.json({ error: "MaterialiRA connection is disabled" }, { status: 400 })
  }

  try {
    const { mraNo } = await request.json()

    if (!mraNo) {
      return NextResponse.json({ error: "MRA number is required" }, { status: 400 })
    }

    // In a real implementation, this would connect to the SQL Server database
    // For now, we'll return mock data

    // Mock implementation of the SQL query
    const mockResult: MaterialiRAResult = {
      marocilnica_ra: "MOCK_MAROCILNICA",
      mra_no: mraNo,
      batch_ra: "MOCK_BATCH",
      intermediate_form_ra: "tableta",
      name_ra: "MOCK_NAME",
      api_strength_ra: "10 mg",
      ra_link: `https://vms-nt2241/MaterialiRA/Common/Document/List?typeid=19&linkid=MOCK_ID`,
    }

    return NextResponse.json(mockResult)

    /* 
    // Real implementation would look something like this:
    
    // Connect to SQL Server
    const sql = require('mssql');
    
    const config = {
      user: 'materialira_client',
      password: 'test',
      server: 'SRC-SQL16PP\\PP16',
      database: 'MaterialiRA',
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    };
    
    await sql.connect(config);
    
    // Execute the stored procedure
    const result = await sql.query`EXEC procOderBySampleID @StVzorca = ${mraNo.trim()}`;
    
    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'No data found for the provided MRA number' }, { status: 404 });
    }
    
    const row = result.recordset[0];
    
    // Map the results
    const materialiraResult: MaterialiRAResult = {
      marocilnica_ra: row.marocilnica_ra,
      mra_no: row.mra_no,
      batch_ra: row.batch_ra,
      intermediate_form_ra: intermediateFormRAMapping[row.intermediate_form_ra] || row.intermediate_form_ra,
      name_ra: row.name_ra,
      api_strength_ra: formatStrength(row.api_strength_ra),
      ra_link: row.marocilnica_ra ? `https://vms-nt2241/MaterialiRA/Common/Document/List?typeid=19&linkid=${row.marocilnica_ra}` : null
    };
    
    return NextResponse.json(materialiraResult);
    */
  } catch (error) {
    console.error("Error querying MaterialiRA database:", error)
    return NextResponse.json({ error: "Failed to query MaterialiRA database" }, { status: 500 })
  }
}
