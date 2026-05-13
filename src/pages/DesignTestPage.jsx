import { Badge } from '../components/ui/shadcn/badge'
import { Button } from '../components/ui/shadcn/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/shadcn/card'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/shadcn/avatar'

export default function DesignTestPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-5 py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Design Test</h1>
          <p className="text-sm text-muted-foreground">
            shadcn/ui 컴포넌트(버튼, 카드, 아바타, 배지) 렌더링 확인용 페이지
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Button</CardTitle>
            <CardDescription>variant / size 조합</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avatar + Badge</CardTitle>
            <CardDescription>Radix Avatar + CVA Badge</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-5">
            <Avatar>
              <AvatarImage src="https://avatars.githubusercontent.com/u/1?v=4" alt="avatar" />
              <AvatarFallback>SL</AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            이미지 로드 실패 시 AvatarFallback이 표시됩니다.
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
