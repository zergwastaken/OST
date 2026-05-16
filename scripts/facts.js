// Display a random fact in the footer and rotate with fade animation every 5 seconds
document.addEventListener('DOMContentLoaded', function() {
	let allFacts = [];
	let currentFactIndex = -1;
	const factElement = document.getElementById('fact-footer');
	
	if (!factElement) return;
	
	fetch('json/facts.json')
		.then(res => res.json())
		.then(facts => {
			allFacts = facts;
			showNextFact();
			
			// Rotate facts every 5 seconds with fade animation
			setInterval(showNextFact, 5000);
		})
		.catch(() => {
			factElement.textContent = 'Could not load fact.';
		});
	
	function showNextFact() {
		if (allFacts.length === 0) return;
		
		// Fade out
		factElement.style.opacity = '0';
		
		setTimeout(() => {
			// Pick next fact (cycle through all facts)
			currentFactIndex = (currentFactIndex + 1) % allFacts.length;
			factElement.textContent = allFacts[currentFactIndex];
			
			// Fade in
			factElement.style.opacity = '1';
		}, 500); // Wait for fade out to complete
	}
});

