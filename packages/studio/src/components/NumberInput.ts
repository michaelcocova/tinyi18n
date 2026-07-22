import type { HTMLAttributes } from 'vue'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldInput,
} from '@/components/ui/number-field'

export const NumberInput = defineComponent({
  props: {
    class: {
      type: String as PropType<HTMLAttributes['class']>,
      default: '',
    },
    contentClass: {
      type: String as PropType<HTMLAttributes['class']>,
      default: '',
    },
    modelValue: {
      type: Number,
      default: 1,
    },
  },
  emits: {
    'update:modelValue': (_value: number) => true,
  },
  setup(props, { emit }) {
    return () => h(
      NumberField,
      {
        'defaultValue': 1,
        'min': 1,
        'max': 99,
        'step': 1,
        'modelValue': props.modelValue,
        'onUpdate:modelValue': (value: number) => emit('update:modelValue', value),
        'stepSnapping': true,
        'class': cn('text-xs shadow-none flex items-center', props.class),
        'onInput': (e: Event) => {
          const target = e.target as HTMLInputElement | null
          if (target && Number(target.value) > 99) {
            target.value = '99'
          }
        },
        'onClick': (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
        },
      },
      {
        default: () => [
          h(NumberFieldContent, () => [
            h(NumberFieldInput, {
              class: cn('h-6 py-0 shadow-none focus-visible:ring-0 text-xs focus-visible:border-slate-400', props?.contentClass),
            }),
          ]),
        ],
      },
    )
  },
})
