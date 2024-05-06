// Initialize EmailJS with your user ID and service ID
emailjs.init('YOUR_USER_ID');

const form = document.querySelector('form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const messageInput = document.getElementById('message');

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const nameValue = nameInput.value.trim();
  const emailValue = emailInput.value.trim();
  const messageValue = messageInput.value.trim();

  if (nameValue === '') {
    alert('Please enter your name');
  } else if (emailValue === '') {
    alert('Please enter your email');
  } else if (messageValue === '') {
    alert('Please enter a message');
  } else {
    // Send form data to EmailJS
    const serviceID = 'YOUR_SERVICE_ID';
    const templateID = 'YOUR_TEMPLATE_ID';
    const templateParams = {
      name: nameValue,
      email: emailValue,
      message: messageValue
    };

    emailjs.send(serviceID, templateID, templateParams)
      .then(() => {
        alert('Message sent successfully!');
        form.reset();
      })
      .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while sending the message');
      });
  }
});

// script.js
// Form validation (existing code remains the same)

// Project slider
const projectSlide = document.querySelector('.project-slide');
const projects = document.querySelectorAll('.project');
let currentIndex = 0;
const slideWidth = projects[0].offsetWidth;

function slideProjects() {
  projectSlide.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
  currentIndex = (currentIndex + 1) % projects.length;
}

setInterval(slideProjects, 3000); // Slide every 3 seconds