document.addEventListener("DOMContentLoaded", () => {
    const budgetInput = document.getElementById("budget");
    const industrySelect = document.getElementById("industry");
    const channelContainer = document.getElementById("channel-selection");
    const mediaPlanTable = document.getElementById("media-plan").querySelector("tbody");
    const chartImpressionsClicksCanvas = document.getElementById("chart-impressions-clicks");
    const chartConversionsCostCanvas = document.getElementById("chart-conversions-cost");
    const pieChartCanvas = document.getElementById("pie-chart");
    let chartImpressionsClicks, chartConversionsCost, pieChart;

    let data = [];
    let channels = [];
    let savedSelections = {}; // Store selections for each industry

    // Initially hide the pie chart and both bar charts
    pieChartCanvas.style.display = "none";
    chartImpressionsClicksCanvas.style.display = "none";
    chartConversionsCostCanvas.style.display = "none";

    // Load CSV data
    Papa.parse("data.csv", {
        download: true,
        header: true,
        complete: function (results) {
            data = results.data;
            populateIndustryDropdown();

            // Automatically select and display channels for the first industry
            const firstIndustry = data[0]?.Industry; // Use the first industry in the data
            if (firstIndustry) {
                industrySelect.value = firstIndustry; // Set dropdown to the first industry
                updateChannelSelection(); // Display channels for the first industry
            }
        },
    });

    function populateIndustryDropdown() {
        // Extract the unique industries
        const industries = [...new Set(data.map(row => row.Industry))];
        
        // Sort industries alphabetically
        industries.sort((a, b) => a.localeCompare(b));

        industries.forEach(industry => {
            const option = document.createElement("option");
            option.value = industry;
            option.textContent = industry;
            industrySelect.appendChild(option);
        });
    }

    industrySelect.addEventListener("change", updateChannelSelection);

    function updateChannelSelection() {
        const selectedIndustry = industrySelect.value;

        // If there are no saved selections for this industry, initialize it
        if (!savedSelections[selectedIndustry]) {
            savedSelections[selectedIndustry] = {};
        }

        // Filter channels based on the selected industry
        channels = data.filter(row => row.Industry === selectedIndustry);

        // Clear the current channel container and rebuild the channels
        channelContainer.innerHTML = "";

        // Create new channels with saved state if any
        channels.forEach(channel => {
            const div = document.createElement("div");
            div.classList.add("channel");

            const label = document.createElement("label");
            label.textContent = channel.Channel;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = savedSelections[selectedIndustry][channel.Channel]?.checked || false; // Use saved state or false
            checkbox.addEventListener("change", () => togglePercentageInput(checkbox, div, channel));

            const percentageInput = document.createElement("input");
            percentageInput.type = "number";
            percentageInput.placeholder = "%";
            percentageInput.disabled = !checkbox.checked;
            percentageInput.value = savedSelections[selectedIndustry][channel.Channel]?.percentage || "";
            percentageInput.addEventListener("input", () => updateMediaPlan());
            percentageInput.addEventListener("focusout", () => handleFocusOut(percentageInput));

            const costLabel = document.createElement("span");
            costLabel.textContent = "$0";

            div.appendChild(checkbox);
            div.appendChild(label);
            div.appendChild(percentageInput);
            div.appendChild(costLabel);

            channelContainer.appendChild(div);
        });

        // Recalculate the media plan and update the chart
        updateMediaPlan();
    }

    function togglePercentageInput(checkbox, div, channel) {
        const percentageInput = div.querySelector("input[type='number']");

        // Enable/disable the percentage input based on checkbox
        if (checkbox.checked) {
            percentageInput.disabled = false;
        } else {
            percentageInput.disabled = true;
        }

        // Save the checkbox and percentage state
        const selectedIndustry = industrySelect.value;
        if (!savedSelections[selectedIndustry]) {
            savedSelections[selectedIndustry] = {};
        }
        savedSelections[selectedIndustry][channel.Channel] = {
            checked: checkbox.checked,
            percentage: percentageInput.value || "",
        };

        // Update media plan
        updateMediaPlan();
    }

    // Prevent clearing input when clicked off
    function handleFocusOut(inputField) {
        const inputValue = inputField.value.trim();
        if (inputValue !== "") {
            inputField.value = inputValue; // Retain the value when clicked off
        }
    }

    // Event listener for budget input change
    budgetInput.addEventListener("input", updateMediaPlan);

    function updateMediaPlan() {
        const budget = parseFloat(budgetInput.value) || 0;
        mediaPlanTable.innerHTML = "";

        let totalMetrics = [];
        let channelAllocations = [];
        const channelElements = channelContainer.querySelectorAll(".channel");

        channelElements.forEach((channelElement, index) => {
            const checkbox = channelElement.querySelector("input[type='checkbox']");
            const percentageInput = channelElement.querySelector("input[type='number']");
            const costLabel = channelElement.querySelector("span");

            // Only calculate if the channel is checked
            if (checkbox.checked) {
                const percentage = parseFloat(percentageInput.value) || 0;
                const cost = (percentage / 100) * budget;
                costLabel.textContent = `$${cost.toLocaleString()}`;

                // Store channel allocation data for pie chart
                channelAllocations.push({ channel: channels[index].Channel, allocation: percentage });

                const channelData = channels[index];
                const CPC = parseFloat(channelData.CPC);
                const CTR = parseFloat(channelData.CTR) / 100;
                const convRate = parseFloat(channelData.ConvRate) / 100;

                // Recalculate the metrics
                const impressions = cost / (CPC * CTR);
                const clicks = cost / CPC;
                const CPM = cost / impressions * 1000;
                const conversions = clicks * convRate;
                const costPerConv = conversions > 0 ? cost / conversions : 0;

                totalMetrics.push({ channel: channelData.Channel, impressions, clicks, cost, conversions });

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${channelData.Channel}</td>
                    <td>${Math.round(impressions).toLocaleString()}</td>
                    <td>${Math.round(clicks).toLocaleString()}</td>
                    <td>${(CTR * 100).toFixed(2)}%</td>
                    <td>$${CPC.toFixed(2)}</td>
                    <td>$${CPM.toFixed(2)}</td>
                    <td>${conversions.toFixed(2)}</td>
                    <td>${(convRate * 100).toFixed(2)}%</td>
                    <td>$${cost.toLocaleString()}</td>
                    <td>$${costPerConv.toFixed(2)}</td>
                `;
                mediaPlanTable.appendChild(row);
            }
        });

        // Only show the charts if there are metrics
        if (totalMetrics.length > 0) {
            chartImpressionsClicksCanvas.style.display = "block";
            chartConversionsCostCanvas.style.display = "block";
            updateChart(totalMetrics);
        } else {
            chartImpressionsClicksCanvas.style.display = "none";
            chartConversionsCostCanvas.style.display = "none";
        }

        updatePieChart(channelAllocations); // Update the pie chart
    }

    function updateChart(metrics) {
        const labels = metrics.map(metric => metric.channel);
        const impressions = metrics.map(metric => metric.impressions);
        const clicks = metrics.map(metric => metric.clicks);
        const conversions = metrics.map(metric => metric.conversions);
        const costs = metrics.map(metric => metric.cost);

        // Update the Impressions vs Clicks chart
        if (chartImpressionsClicks) chartImpressionsClicks.destroy();
        chartImpressionsClicks = new Chart(chartImpressionsClicksCanvas, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Impressions",
                        data: impressions,
                        backgroundColor: "rgba(75, 192, 192, 0.6)",
                        yAxisID: "y",
                    },
                    {
                        label: "Clicks",
                        data: clicks,
                        backgroundColor: "rgba(153, 102, 255, 0.6)",
                        yAxisID: "y1",
                    },
                ],
            },
            options: {
                scales: {
                    y: { type: "linear", position: "left" },
                    y1: { type: "linear", position: "right" },
                },
            },
        });

        // Update the Conversions vs Cost chart
        if (chartConversionsCost) chartConversionsCost.destroy();
        chartConversionsCost = new Chart(chartConversionsCostCanvas, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Conversions",
                        data: conversions,
                        backgroundColor: "rgba(255, 99, 132, 0.6)",
                        yAxisID: "y",
                    },
                    {
                        label: "Cost",
                        data: costs,
                        backgroundColor: "rgba(54, 162, 235, 0.6)",
                        yAxisID: "y1",
                    },
                ],
            },
            options: {
                scales: {
                    y: { type: "linear", position: "left" },
                    y1: { type: "linear", position: "right" },
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem) {
                            const dataset = tooltipItem.datasetIndex;
                            let value = tooltipItem.raw;
                            if (dataset === 0) { // Conversions
                                return "Conversions: " + value.toFixed(2);
                            } else if (dataset === 1) { // Cost
                                // Format the cost as currency
                                return "Cost: " + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
                            }
                        },
                    },
                },
            },
        });
    }

    function updatePieChart(allocations) {
        const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.allocation, 0);
        if (totalPercentage > 0) {
            pieChartCanvas.style.display = "block";
            if (pieChart) pieChart.destroy();
            pieChart = new Chart(pieChartCanvas, {
                type: "pie",
                data: {
                    labels: allocations.map(alloc => alloc.channel),
                    datasets: [{
                        data: allocations.map(alloc => alloc.allocation),
                        backgroundColor: ["#ff6384", "#36a2eb", "#cc65fe", "#ffce56", "#ff8f00", "#c2c2c2"],
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: "top",
                        },
                    },
                },
            });
        } else {
            pieChartCanvas.style.display = "none";
        }
    }
});
