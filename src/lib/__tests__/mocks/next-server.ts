// Mock pour next/server dans les tests
export class NextRequest {}
export class NextResponse {
  static json(data: any, init?: any) {
    return { data, ...init }
  }
}
