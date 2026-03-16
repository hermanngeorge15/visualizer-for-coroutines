import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input } from '@heroui/react'

const createSessionSchema = z.object({
  name: z.string().optional(),
})

type CreateSessionData = z.infer<typeof createSessionSchema>

interface CreateSessionFormProps {
  onSubmit: (name?: string) => void
  isSubmitting?: boolean
}

export function CreateSessionForm({ onSubmit, isSubmitting }: CreateSessionFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSessionData>({
    resolver: zodResolver(createSessionSchema),
  })

  const onFormSubmit = (data: CreateSessionData) => {
    onSubmit(data.name || undefined)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex gap-2">
      <Input
        placeholder="Session name (optional)"
        {...register('name')}
        errorMessage={errors.name?.message}
        className="flex-1"
      />
      <Button
        type="submit"
        color="primary"
        isLoading={isSubmitting}
      >
        Create
      </Button>
    </form>
  )
}

