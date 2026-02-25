<script lang="ts">
	type Props = {
		value: string;
		placeholder?: string;
		disabled?: boolean;
		gradient: string;
		buttonText?: string;
		onsubmit: () => void;
		oninput: (value: string) => void;
		maxlength?: number;
		minlength?: number;
	};

	let { value = $bindable(), placeholder = 'Tapez votre proposition...', disabled = false, gradient, buttonText = 'Envoyer', onsubmit, oninput, maxlength, minlength }: Props = $props();
</script>

<form onsubmit={(e) => { e.preventDefault(); onsubmit(); }} class="flex gap-3">
	<input
		type="text"
		bind:value
		oninput={(e) => oninput(e.currentTarget.value)}
		{placeholder}
		{maxlength}
		{minlength}
		{disabled}
		class="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2"
		style="border-color: {disabled ? '#d1d5db' : 'inherit'}; focus:ring-color: rgba(0,0,0,0.1);"
	/>
	<button
		type="submit"
		{disabled}
		class="rounded-lg bg-gradient-to-r {gradient} px-6 py-3 font-medium text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
	>
		{buttonText}
	</button>
</form>
