import { NextResponse } from "next/server"
import { supabase } from '@/lib/supabase'


export async function GET() {
  try {
    const { data, error } = await supabase
      .from('mastodon_instances')
      .select('instance')
      .order('instance')

    if (error) {
      console.error('Error fetching Mastodon instances:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch Mastodon instances' },
        { status: 500 }
      )
    }

    // Transformation des données pour n'avoir que la liste des instances
    const instances = data.map(item => item.instance)

    return NextResponse.json({
      success: true,
      instances: instances
    })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}