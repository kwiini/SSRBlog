<template>
  <div
    :class="[
      'rounded-lg flex items-center justify-center shrink-0',
      'bg-stone-800 dark:bg-stone-100',
      'group-hover:scale-105 transition-transform duration-300',
      sizeBox,
    ]"
  >
    <svg
      :class="['text-white dark:text-stone-800', sizeIcon]"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <!-- C 形主体,象征 Curata 的 C 与卷起的文献 -->
      <path
        d="M19 8 A 7 7 0 1 0 19 16"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
      />
      <!-- 文献文字行 -->
      <line
        x1="10"
        y1="9.5"
        x2="14"
        y2="9.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <line
        x1="9.5"
        y1="12"
        x2="14"
        y2="12"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <line
        x1="10"
        y1="14.5"
        x2="13.5"
        y2="14.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <!-- AI 灵感点 -->
      <path
        d="M19.5 4 L 19.9 5.2 L 21.1 5.6 L 19.9 6 L 19.5 7.2 L 19.1 6 L 17.9 5.6 L 19.1 5.2 Z"
        fill="currentColor"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  size: "sm",
});

const sizeMap = {
  sm: { box: "w-7 h-7", icon: "w-4 h-4" },
  md: { box: "w-9 h-9", icon: "w-5 h-5" },
  lg: { box: "w-12 h-12", icon: "w-7 h-7" },
};

const sizeBox = computed(() => sizeMap[props.size].box);
const sizeIcon = computed(() => sizeMap[props.size].icon);
</script>
