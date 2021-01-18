// global storyList variable
let storyList = null;

// global currentUser variable
let currentUser = null;

// global var that will hold a jQuery object of the current article list the user is looking at. Initialize to all articles
let $currentView = $("#all-articles-list");

$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $favoritedArticles = $('#favorited-articles');
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navWelcome = $("#nav-welcome");

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    //Remove error message if there was one
    $('.login-error').remove();

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    try {

      // call the login static method to build a user instance
      const userInstance = await User.login(username, password);
      // set the global user to the user instance
      currentUser = userInstance;

      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();

    } catch(error) {

      //Add an error message to the form if the API call above fails
      $loginForm.append(`<p class="login-error">${error.response.data.error.message}</p>`);

    }
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    //Remove error message if there was one
    $('.login-error').remove();

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    try {

      // call the create method, which calls the API and then builds a new user instance
      const newUser = await User.create(username, password, name);
      currentUser = newUser;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();

    } catch (error) {

      //Add an error message if the API call above fails
      $createAccountForm.append(`<p class="login-error">${error.response.data.error.message}</p>`);

    }
    
  });

  /**
   * Event listener for submitting a new story.
   * If successful we create a new story and add it to the top of the list
   */
  $submitForm.on('submit', async function(evt) {
    evt.preventDefault();

    //grab the required fields and put them in an object
    const newStory = {
      author: $('#author').val(),
      title: $('#title').val(),
      url: $('#url').val()
    };

    //Add story to API and get a story object back
    const storyObj = await storyList.addStory(currentUser, newStory);

    //Add story to User's own stories
    currentUser.ownStories.push(storyObj);

    //Add story to stories list based on request return
    $allStoriesList.prepend(generateStoryHTML(storyObj));
    
    //Reset and close the form
    $submitForm.trigger("reset");
    $submitForm.slideToggle();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
    //Remove error message if there was one
    $('.login-error').remove();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Event handler for navigation to favorites list
   */
   $('#favorites').on('click', function() {
    //Generate list of favorite articles and populate the favorite articles element
    generateUserList(currentUser.favorites, $favoritedArticles);
   })

   /**
    * Event handler for navigation to your own stories list
    */
   $('#my-stories').on('click', function() {
     //Generate list of own articles and populate the my articles element
     generateUserList(currentUser.ownStories, $ownStories);
   })

  /**
   * Event handler for clicking submit to open story form
   */
  $('#submit-story').on('click', function() {
    $submitForm.slideToggle();
  })

  /**
   * Add a story to the user's favorites when it has not been favorited yet, and remove it if it has already been favorited
   */
  async function toggleFavorite(evt) {
  //Story ID passed to the delete function is located in the ID of the parent element
  //Pass that ID to either the delete or add favorite class
    if ($(evt.target).hasClass('favorited')) {
      await currentUser.deleteFavorite($(evt.target).parent().attr('id'));
    } else {
      await currentUser.addFavorite($(evt.target).parent().attr('id'));
    }

    //Toggle star style from solid to regular, and toggle the favorited class
    $(evt.target).toggleClass(['fas', 'far', 'favorited'])

    //If we're looking at the list of favorites, remove the article from the page and reload the list.
    if ($currentView === $favoritedArticles) {
      $(evt.target).parent().remove();
      generateUserList(currentUser.favorites, $favoritedArticles)
    }
  }

  /**
   * Event handler for the delete button, which deletes the story from the list as well as the API
   */
  async function deleteOwnStory(evt) {
    //Get the story ID from the parent element of the delete button
    const storyId = $(evt.target).parent().attr('id');

    //Pass the story ID to the delete story function of the story list
    await storyList.deleteStory(currentUser, storyId);

    //Remove the story from the user's own story list
    for (let story of currentUser.ownStories) {
      //If the story IDs match the deleted story, remove the story from the ownStories array
      if (story.storyId === storyId) {
        currentUser.ownStories.splice(currentUser.ownStories.indexOf(story))
      }
    }

    //Remove the element for the deleted item from the page
    $(evt.target).parent().remove();
  }

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    generateStories();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // Show loading view in the all stories list
    showLoading($allStoriesList);

    //Set current view to all articles list
    $currentView = $allStoriesList

    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();

    // update our global variable
    storyList = storyListInstance;

    //Clear the loading message
    hideLoading();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  function generateUserList(list, $target) {
    //Clear current view and show the loading view in the targeted list
    showLoading($target);

    //Set global storylist to a new storyList from the list passed
    storyList = new StoryList(list);

    //Set the current view to the target view
    $currentView = $target;

    //Clear loading
    hideLoading();

    // loop through all of our stories and generate HTML for them. Append them in the order they were added to the user's list
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $target.append(result);
    }

    //Append a message if there were no stories added
    if (list.length === 0) {
      $target.append(`<p>No stories to show.</p>`)
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const $storyMarkup = $(`
      <li id="${story.storyId}">
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    //If the user is logged in, add the user buttons
    if (currentUser) {
      addUserButtons($storyMarkup, story);
    }

    return $storyMarkup;
  }

  function addUserButtons($storyMarkup, story) {
    //First create the favorite button with an event listener
    const $favButton = $('<i class="far fa-star star favorite"></i>')
                        .on('click', toggleFavorite);

    //Add the favorited class and switch to a solid star if the ID of this story matches one in the user's favorites
    for (let favorite of currentUser.favorites) {
      if (favorite.storyId === story.storyId) {
        $favButton.toggleClass(['favorited', 'fas', 'far']);
      }
    };

    //Append favorite buttton to all LIs
    $storyMarkup.prepend($favButton);

    //If this is one of the user's own stories, add a delete button
    for (let ownStory of currentUser.ownStories) {
      if(ownStory.storyId === story.storyId) {
        $delete = $('<i class="far fa-trash-alt trash-can"></i>')
                  .on('click', deleteOwnStory);
        $storyMarkup.prepend($delete)
      }
    }
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $('#nav-user-profile').text(currentUser.username);
    $('#main-nav').show();
    $navWelcome.show();
  }

  /**
   * Clears the current view and displays a loading message in the next one while it populates.
   * The passed argument should be a jQuery object representing the article list we want 
   * to show next
   */
  function showLoading($loadingView) {
    //Hide and empty the current view
    $currentView.empty();
    $currentView.hide();

    //Show the loading view and append a loading message to it
    $loadingView.show();
    $loadingView.append('<h3>Loading...</h3>');
  }

  /**
   * Remove the loading message from the current view before we populate it
   */
  function hideLoading() {
    $currentView.empty();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
